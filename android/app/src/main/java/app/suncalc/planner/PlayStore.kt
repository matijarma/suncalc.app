package app.suncalc.planner

import android.app.Activity
import com.android.billingclient.api.*
import org.json.JSONObject

internal class PlayStore(
    private val activity: Activity,
    private val access: Entitlements,
    private val update: () -> Unit,
    private val notify: (String) -> Unit,
) {
    data class Offer(val details: ProductDetails, val token: String?, val price: String)

    private val offers = mutableMapOf<String, Offer>()
    private val owned = mutableSetOf<String>()
    private var inventoryReady = false
    private var busy = false
    private var querying = false
    private var connecting = false
    private val client =
        BillingClient.newBuilder(activity)
            .enablePendingPurchases(
                PendingPurchasesParams.newBuilder().enableOneTimeProducts().build(),
            )
            .enableAutoServiceReconnection()
            .setListener { r, purchases ->
                activity.runOnUiThread {
                    busy = false
                    when (r.responseCode) {
                        BillingClient.BillingResponseCode.OK ->
                            purchases.orEmpty().forEach(::process)
                        BillingClient.BillingResponseCode.USER_CANCELED ->
                            notify("Purchase canceled.")
                        else ->
                            notify(
                                "Google Play could not finish the purchase. Use Restore purchases to retry.",
                            )
                    }
                    update()
                }
            }
            .build()

    private fun process(p: Purchase) {
        owned.addAll(p.products)
        if (p.purchaseState == Purchase.PurchaseState.PENDING) {
            notify("Payment is pending in Google Play.")
            return
        }
        if (p.purchaseState != Purchase.PurchaseState.PURCHASED) return
        p.products
            .filter { it == LIFE || it == MONTH }
            .forEach { id ->
                access.sync(id, p.purchaseToken) { ok ->
                    activity.runOnUiThread {
                        notify(
                            if (ok) "Purchase verified."
                            else "Could not verify the purchase yet. Restore again when online.",
                        )
                    }
                }
            }
    }

    fun refresh(manual: Boolean = false) {
        if (!client.isReady) {
            if (connecting) return
            connecting = true
            client.startConnection(
                object : BillingClientStateListener {
                    override fun onBillingSetupFinished(result: BillingResult) {
                        activity.runOnUiThread {
                            connecting = false
                            if (result.responseCode == 0) refresh(manual)
                            else if (manual)
                                notify("Google Play is unavailable on this installation.")
                        }
                    }

                    override fun onBillingServiceDisconnected() {
                        activity.runOnUiThread {
                            connecting = false
                            inventoryReady = false
                            update()
                        }
                    }
                },
            )
            return
        }
        if (querying) return
        querying = true
        inventoryReady = false
        offers.clear()
        val types =
            mapOf(MONTH to BillingClient.ProductType.SUBS, LIFE to BillingClient.ProductType.INAPP)
        val found = mutableSetOf<String>()
        var remaining = 2
        var complete = true
        types.forEach { (id, type) ->
            val product =
                QueryProductDetailsParams.Product.newBuilder()
                    .setProductId(id)
                    .setProductType(type)
                    .build()
            client.queryProductDetailsAsync(
                QueryProductDetailsParams.newBuilder().setProductList(listOf(product)).build(),
            ) { r, details ->
                activity.runOnUiThread {
                    if (r.responseCode == 0)
                        details.productDetailsList.firstOrNull()?.let { d ->
                            if (id == MONTH)
                                d.subscriptionOfferDetails
                                    ?.firstOrNull {
                                        it.basePlanId == "monthly" && it.offerId == null
                                    }
                                    ?.let { o ->
                                        o.pricingPhases.pricingPhaseList.lastOrNull()?.let {
                                            offers[id] = Offer(d, o.offerToken, it.formattedPrice)
                                        }
                                    }
                            else
                                d.oneTimePurchaseOfferDetailsList
                                    ?.firstOrNull { it.offerId == null && it.rentalDetails == null }
                                    ?.let {
                                        offers[id] = Offer(d, it.offerToken, it.formattedPrice)
                                    }
                        }
                    update()
                }
            }
            client.queryPurchasesAsync(
                QueryPurchasesParams.newBuilder().setProductType(type).build(),
            ) { r, list ->
                activity.runOnUiThread {
                    if (r.responseCode == 0) {
                        list.forEach {
                            found.addAll(it.products)
                            process(it)
                        }
                    } else complete = false
                    if (--remaining == 0) {
                        querying = false
                        inventoryReady = complete
                        if (complete) {
                            owned.clear()
                            owned.addAll(found)
                        }
                        if (manual && found.isEmpty())
                            notify(
                                if (complete) "No purchases found on this Google Play account."
                                else "Could not reach Google Play.",
                            )
                        update()
                    }
                }
            }
        }
    }

    fun prices() =
        JSONObject().apply {
            if (inventoryReady && !busy && owned.none { it == LIFE || it == MONTH })
                offers.forEach { (id, o) -> put(id, o.price) }
        }

    fun buy(id: String) {
        val offer = offers[id]
        val s = access.state()
        if (
            offer == null ||
                !client.isReady ||
                !inventoryReady ||
                owned.isNotEmpty() ||
                busy ||
                !s.optBoolean("commerceReady") ||
                s.getString("kind") in listOf("lifetime", "monthly")
        ) {
            notify("Purchase unavailable. Refresh Google Play or restore an existing purchase.")
            return
        }
        val product =
            BillingFlowParams.ProductDetailsParams.newBuilder()
                .setProductDetails(offer.details)
                .apply { offer.token?.let { setOfferToken(it) } }
                .build()
        busy = true
        update()
        val result =
            client.launchBillingFlow(
                activity,
                BillingFlowParams.newBuilder().setProductDetailsParamsList(listOf(product)).build(),
            )
        if (result.responseCode != 0) {
            busy = false
            notify("Google Play could not open checkout.")
            update()
        }
    }

    fun close() = client.endConnection()
}

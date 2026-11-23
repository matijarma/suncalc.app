package app.suncalc.planner

import org.junit.Assert.assertEquals
import org.junit.Test

class AccessTest {
    @Test
    fun clockRollbackDoesNotRestoreTrial() {
        val deadline = 1000L + WEEK
        val now = effectiveTime(0, deadline - 1, 102, 100)
        assertEquals("locked", accessKind(now, deadline, 0, false))
        assertEquals(now, effectiveTime(2, now, 1, 102))
    }

    @Test
    fun subscriptionExpiresAtBoundaryWhileLifetimePersists() {
        assertEquals("trial", accessKind(29, 30, 0, false))
        assertEquals("monthly", accessKind(30, 30, 40, false))
        assertEquals("locked", accessKind(40, 30, 40, false))
        assertEquals("lifetime", accessKind(41, 30, 40, true))
    }
}

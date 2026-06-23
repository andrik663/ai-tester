import { db } from "@/lib/db"
import { apiUsageLogs, apiKeys } from "@/lib/db/api-key-schema"
import { eq, and, gte } from "drizzle-orm"
import { NextRequest, NextResponse } from "next/server"

export async function GET(req: NextRequest) {
  try {
    const keyId = req.nextUrl.searchParams.get("keyId")
    const days = parseInt(req.nextUrl.searchParams.get("days") || "7")

    if (!keyId) {
      return NextResponse.json(
        { error: "Missing required query parameter: keyId" },
        { status: 400 }
      )
    }

    // Get date range
    const startDate = new Date(Date.now() - days * 24 * 60 * 60 * 1000)

    // Get usage logs for this key in the date range
    const usageLogs = await db.query.apiUsageLogs.findMany({
      where: and(
        eq(apiUsageLogs.apiKeyId, keyId),
        gte(apiUsageLogs.requestAt, startDate)
      ),
    })

    // Calculate statistics
    const totalRequests = usageLogs.length
    const successfulRequests = usageLogs.filter((log) => log.statusCode && log.statusCode < 400).length
    const failedRequests = usageLogs.filter((log) => log.statusCode && log.statusCode >= 400).length
    const avgResponseTime = usageLogs.length > 0
      ? Math.round(
          usageLogs.reduce((sum, log) => sum + (log.responseTimeMs || 0), 0) /
            usageLogs.length
        )
      : 0

    // Group by endpoint
    const endpointStats: Record<string, { count: number; avgTime: number }> = {}
    usageLogs.forEach((log) => {
      if (!endpointStats[log.endpoint]) {
        endpointStats[log.endpoint] = { count: 0, avgTime: 0 }
      }
      endpointStats[log.endpoint].count++
      endpointStats[log.endpoint].avgTime += log.responseTimeMs || 0
    })

    Object.keys(endpointStats).forEach((endpoint) => {
      endpointStats[endpoint].avgTime = Math.round(
        endpointStats[endpoint].avgTime / endpointStats[endpoint].count
      )
    })

    return NextResponse.json({
      success: true,
      stats: {
        period: {
          days,
          startDate,
          endDate: new Date(),
        },
        requests: {
          total: totalRequests,
          successful: successfulRequests,
          failed: failedRequests,
          successRate: totalRequests > 0 ? ((successfulRequests / totalRequests) * 100).toFixed(2) + "%" : "N/A",
        },
        performance: {
          avgResponseTimeMs: avgResponseTime,
        },
        byEndpoint: endpointStats,
      },
    })
  } catch (error) {
    console.error("[Get API Stats Error]", error)
    return NextResponse.json(
      { error: "Failed to get API statistics" },
      { status: 500 }
    )
  }
}

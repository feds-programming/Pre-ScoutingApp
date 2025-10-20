'use server'

import {ActionResult} from "@/lib/database/action-result";
import prisma from "@/lib/prisma";
import { meanOrNumber, seasonWinrate } from '@/lib/statbotics/normalize';

export default async function GeneratePastSeasons(season: any, tbaTeam: any, teamNumber: number): Promise<ActionResult> {
    const data = {
        year: season.year,
        winrate: seasonWinrate(season),
        rank: season?.epa?.ranks?.total?.rank ?? 0,
        totalTeams: season?.epa?.ranks?.total?.team_count ?? 0,
        epa: meanOrNumber(season?.epa?.breakdown?.total_points),
        percentile: 1 - (season?.epa?.ranks?.total?.percentile ?? 0),
        teamNumber: teamNumber
    }

    if ((await prisma.teamPastSeason.findFirst({
        where: {
            teamNumber: tbaTeam.team_number,
            year: season.year
        }
    }))) {
        await prisma.teamPastSeason.updateMany(
              {
                  where: {
                      teamNumber: tbaTeam.team_number,
                      year: season.year
                  },
                  data
              }
        )
    } else {
        await prisma.teamPastSeason.create({data})
    }

    return {success: true};
}
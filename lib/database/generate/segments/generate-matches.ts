'use server'

import {ActionResult} from "@/lib/database/action-result";
import prisma from "@/lib/prisma";

export default async function GenerateMatches(tbaMatch: any, statboticsMatch: any, eventId: number, teamEntryId: number): Promise<ActionResult> {
    // Skip in progress matches
    if (tbaMatch.actual_time == undefined) return {success: true};

    const data = {
        key: tbaMatch.key,
        startTime: tbaMatch.actual_time,
        eventKey: tbaMatch.event_key,
        matchNumber: tbaMatch.match_number,
        compLevel: tbaMatch.comp_level,
        winningAlliance: tbaMatch.winning_alliance ?? "red",
        scoreBreakdown: JSON.stringify(tbaMatch.score_breakdown),
        redScore: tbaMatch.alliances?.red?.score ?? 0,
        redTeamKeys: tbaMatch.alliances?.red?.team_keys ?? [],
        blueScore: tbaMatch.alliances?.blue?.score ?? 0,
        blueTeamKeys: tbaMatch.alliances?.blue?.team_keys ?? [],
        videoId: tbaMatch.videos?.find((x: { type: string }) => x.type == "youtube")?.key
    }

    await prisma.match.upsert({
        where: { key: tbaMatch.key },
        update: data,
        create: data
    });

    const matchEntryUpdate = await prisma.matchEntry.updateMany({
        where: {
            teamEntryId: teamEntryId,
            matchKey: tbaMatch.key
        },
        data: {
            totalEPA: statboticsMatch?.total_points ?? -1,
            autoEPA: statboticsMatch?.auto_points ?? -1,
            teleopEPA: statboticsMatch?.teleop_points ?? -1,
            endgameEPA: statboticsMatch?.endgame_points ?? -1,
        }
    });
    
    if (matchEntryUpdate.count === 0) {
        await prisma.matchEntry.create({
            data: {
                teamEntryId: teamEntryId,
                totalEPA: statboticsMatch?.total_points ?? -1,
                autoEPA: statboticsMatch?.auto_points ?? -1,
                teleopEPA: statboticsMatch?.teleop_points ?? -1,
                endgameEPA: statboticsMatch?.endgame_points ?? -1,
                status: "notStarted",
                eventId: eventId,
                matchKey: tbaMatch.key
            }
        });
    }

    return {success: true};
}
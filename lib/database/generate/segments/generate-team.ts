'use server'

import {ActionResult} from "@/lib/database/action-result";
import prisma from "@/lib/prisma";
import {statbotics} from "@/lib/statbotics/statbotics";
import { meanOrNumber, seasonWins, seasonWinrate, seasonTies, seasonLosses } from '@/lib/statbotics/normalize';
import {tba} from "@/lib/tba/tba";
import GenerateTeamEvents from "@/lib/database/generate/segments/generate-team-events";
import GeneratePastSeasons from "@/lib/database/generate/segments/generate-past-seasons";
import GenerateMatches from "@/lib/database/generate/segments/generate-matches";

export default async function GenerateTeam(tbaTeam: any, eventId: number, year: number, totalTeams: number, updateMatches: boolean): Promise<ActionResult> {
    // Team
    const teamData = {
        number: tbaTeam.team_number,
        key: tbaTeam.key,
        name: tbaTeam.nickname,
        state: tbaTeam.state_prov,
        school: tbaTeam.school_name,
        rookieYear: tbaTeam.rookie_year,
    }

    if (await prisma.team.findFirst({
        where: {
            number: tbaTeam.team_number
        }
    })) {
        await prisma.team.update({
            where: {
                number: tbaTeam.team_number
            },
            data: teamData
        });
    } else {
        await prisma.team.create({data: teamData});
    }

    // Team Entry
    const stats = await statbotics.GET("/v3/team_year/{team}/{year}", {
        params: {path: {year: year, team: tbaTeam.team_number.toString()}}
    });
    if (!stats.data) return {success: false, message: "Statbotics API request error (c): " + stats.response.status};

    const teamEntryData = {
        key: tbaTeam.key,
        eventId: eventId,
        name: tbaTeam.nickname,
        teamNumber: tbaTeam.team_number,
    wins: seasonWins(stats.data),
    ties: seasonTies(stats.data),
    losses: seasonLosses(stats.data),
      worldRank: stats.data?.epa?.ranks?.total?.rank ?? null,
      worldTotal: stats.data?.epa?.ranks?.total?.team_count ?? null,
      countyRank: stats.data?.epa?.ranks?.country?.rank ?? null,
      countyTotal: stats.data?.epa?.ranks?.country?.team_count ?? null,
      districtRank: stats.data?.epa?.ranks?.district?.rank ?? null,
      districtTotal: stats.data?.epa?.ranks?.district?.team_count ?? null,
        eventTotal: totalTeams,
      autoEPA: meanOrNumber(stats.data?.epa?.breakdown?.auto_points),
      teleopEPA: meanOrNumber(stats.data?.epa?.breakdown?.teleop_points),
      endgameEPA: meanOrNumber(stats.data?.epa?.breakdown?.endgame_points),
      totalEPA: meanOrNumber(stats.data?.epa?.breakdown?.auto_points) +
          meanOrNumber(stats.data?.epa?.breakdown?.teleop_points) +
          meanOrNumber(stats.data?.epa?.breakdown?.endgame_points)
    }

    let teamEntry = await prisma.teamEntry.findFirst({
        where: {
            eventId: eventId,
            teamNumber: tbaTeam.team_number
        }
    });
    if (teamEntry) {
        await prisma.teamEntry.updateMany(
              {
                  where: {
                      eventId: eventId,
                      teamNumber: tbaTeam.team_number
                  },
                  data: teamEntryData
              }
        );
    } else {
        teamEntry = await prisma.teamEntry.create({data: teamEntryData});
    }

    // Team Events
    const teamEvents = (await tba.GET("/team/{team_key}/events/{year}", {
        params: {
            path: {
                team_key: tbaTeam.key,
                year: year
            },
        },
    }));
    if (!teamEvents.response.ok) {
        return {success: false, message: "TBA API request error (d): " + teamEvents.response.status}
    }
    if (teamEvents.data) {
        const generateTeamEventsError = (await Promise.all(
              teamEvents.data.map((teamEvents) => GenerateTeamEvents(teamEvents, tbaTeam))
        )).find(res => !res.success);
        if (generateTeamEventsError) return generateTeamEventsError;
    }

    // Past Seasons
    const pastSeasons = await statbotics.GET("/v3/team_years", {
        params: {
            query: {
                team: tbaTeam.team_number.toString()
            }
        }
    });
    if (!pastSeasons.data) return {
        success: false,
        message: "Statbotics API request error (g): " + pastSeasons.response.status
    };

    const generatePastSeasonsError = (await Promise.all(
          pastSeasons.data.map((season) => GeneratePastSeasons(season, tbaTeam, tbaTeam.team_number))
    )).find(res => !res.success);
    if (generatePastSeasonsError) return generatePastSeasonsError;

    // Matches
    if (updateMatches) {
        const tbaMatches = (await tba.GET("/team/{team_key}/matches/{year}", {
            params: {
                path: {
                    team_key: tbaTeam.key,
                    year: year
                },
            },
        }))
        if (!tbaMatches.data) {
            return {success: false, message: "TBA API request error (h): " + tbaMatches.response.status}
        }

        const statboticsMatches = await statbotics.GET("/v3/team_matches", {
            params: {
                query: {
                    team: tbaTeam.team_number.toString(),
                    year: year
                }
            }
        });
        if (!statboticsMatches.data) return {
            success: false,
            message: "Statbotics API request error (i): " + pastSeasons.response.status
        };

        const generateMatchesError = (await Promise.all(
              tbaMatches.data.map((match) => GenerateMatches(
                    match,
                    statboticsMatches.data.find(statboticsMatch => statboticsMatch.match === match.key)?.epa?.breakdown,
                    eventId,
                    teamEntry.id
              ))
        )).find(res => !res.success);
        if (generateMatchesError) return generateMatchesError;
    }

    return {success: true}
}
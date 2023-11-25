/* eslint-disable @typescript-eslint/no-unsafe-call */
/* eslint-disable @typescript-eslint/no-unsafe-member-access */
/* eslint-disable @typescript-eslint/no-unsafe-return */
/* eslint-disable @typescript-eslint/no-unsafe-assignment */
import {
  createTRPCRouter,
  protectedProcedure,
  publicProcedure,
} from "@/server/api/trpc";
import { z } from "zod";
import { createEventSchema } from "./Event/event.schema";

export const eventRouter = createTRPCRouter({
  getAll: publicProcedure.query(async ({ ctx }) => {
    const events = await ctx.prisma.event.findMany({
      orderBy: {
        date: "desc",
      },
    });

    return events;
  }),

  findUnique: publicProcedure
    .input(
      z.object({
        id: z.string(),
      })
    )
    .query(async ({ ctx, input }) => {
      const currentUser = ctx.session?.user;

      const event = await ctx.prisma.event.findUnique({
        where: {
          id: input.id,
        },

        include: {
          projects: {
            orderBy: {
              createdAt: "desc",
            },
            include: {
              members: {
                select: {
                  id: true,
                  name: true,
                },
              },
              _count: {
                select: {
                  likes: true,
                },
              },
              techs: {
                include: {
                  tech: {
                    select: {
                      label: true,
                    },
                  },
                },
              },
              comments: {
                include: {
                  user: {
                    select: {
                      id: true,
                      name: true,
                      title: true,
                      image: true,
                      techs: {
                        include: {
                          tech: {
                            select: {
                              id: true,
                              label: true,
                              imgUrl: true,
                            },
                          },
                        },
                      },
                    },
                  },
                },
                orderBy: {
                  createdAt: "desc",
                },
              },
              author: {
                select: {
                  id: true,
                  email: true,
                  name: true,
                },
              },
            },
          },
          members: {
            select: {
              id: true,
              name: true
            }
          },
        },
      });

      if (currentUser) {
        const membersWithUserStatus = event?.members?.map(member => ({
          ...member,
          isCurrentUserMember: member.id === currentUser.id
        }));

        const projectsWithUser = event?.projects?.map((project) => {
          const isMember = project?.members?.some(
            (member) => member.id === currentUser.id
          );

          return {
            ...project,
            isMember,
          };
        });

        const isUserPartOfAnyProject = projectsWithUser?.some(
          (project) => project.isMember
        );

        return {
          ...event,
          members: membersWithUserStatus,
          projects: projectsWithUser?.map((project) => ({
            ...project,
            isUserPartOfAnyProject,
          })),
        };
      }

      return event;
    }),

  create: protectedProcedure
    .input(createEventSchema)
    .mutation(async ({ ctx, input }) => {
      const event = await ctx.prisma.event.create({
        data: {
          ...input,
        },
      });

      return event;
    }),
  
  attendEvent: protectedProcedure
    .input(
      z.object({
        eventId: z.string(),
        userId: z.string(),
      })
    )
    .mutation(async ({ ctx, input }) => {
      return ctx.prisma.user.update({
        where: {
          id: input.userId,
        },
        data: {
          memberOfEvents: {
            connect: {
              id: input.eventId,
            },
          },
        },
      });
    }),

  // getAllAttendees: publicProcedure
  //   .input(z.object({
  //     eventId: z.string(),
  //   }))
  //   .query(async ({ ctx, input }) => {
  //     const attendees = await ctx.prisma.event.findUnique({
  //       where: {
  //         id: input.eventId,
  //       },
  //       include: {
  //         users: true
  //     });

  //     // Assuming you want to return just the users, not the entire event object.
  //     return attendees ? attendees.users : [];
  //   }),

  getAllUsersAttendingEventButNotInProjects: protectedProcedure
  .input(
    z.object({
      eventId: z.string(),
    })
  )
  .query(async ({ ctx, input }) => {
    const usersAttendingEventNotInProjects = await ctx.prisma.user.findMany({
      where: {
        // Checking if the user is part of the specific event
        memberOfEvents: {
          some: {
            id: input.eventId,
          },
        },
        // Ensuring the user is not part of any project
        memberOfProjects: {
          none: {},
        },
      },
      select: {
        name: true,
        email: true,
      }
    });

    return usersAttendingEventNotInProjects;
  }),

});

// we want to get the memebers of the event 
// and then we want to loop through this to find who's attending the event 
// 
const { paginateResults } = require('./utils');

module.exports = {
    Mission: {
        missionPatch: (mission, { size } = { size: 'LARGE' }) => {
          return size === 'SMALL' ? mission.missionPatchSmall : mission.missionPatchLarge;
        },
    },
    Launch: {
        isBooked: async (launch, _, { dataSources }) =>
          dataSources.userAPI.isBookedOnLaunch({ launchId: launch.id }),
    },
    User: {
        trips: async (_, __, { dataSources }) => {
            // get ids of launches by user
            const launchIds = await dataSources.userAPI.getLaunchIdsByUser();
            if (!launchIds.length) return [];
            // look up those launches by their ids
            return ( dataSources.launchAPI.getLaunchsByIds({ launchIds }) || [] );
        }
    },
    Query: {
        launches: async (_, { pageSize = 20, after }, { dataSources }) => { 
            const launches = await dataSources.launchAPI.getAllLaunches();
            launches.reverse();
            const paginated = paginateResults({
                after,
                pageSize,
                results: launches
            });
            return {
                launches: paginated,
                cursor: paginated.length ? paginated[paginated.length - 1].cursor : null,
                hasMore: paginated.length ? paginated[paginated.length - 1].cursor !== launches[launches.length - 1].cursor : false
            }
        },
        launch: (_, { id }, { dataSources }) => dataSources.launchAPI.getLaunchById({ launchId: id }),
        me: (_, __, { dataSources }) => dataSources.userAPI.findOrCreateUser()
    },
    Mutation: {
        login: async (_, { email }, { dataSources }) => {
            const user = await dataSources.userAPI.findOrCreateUser({email});
            if (user) {
                user.token = Buffer.from(email).toString('base64');
                return user;
            }
        },
        bookTrips: async (_, { launchIds }, { dataSources}) => {
            const results = await dataSources.userAPI.bookTrips({ launchIds });
            const launches = await dataSources.launchAPI.getLaunchsByIds({ launchIds });
            return {
                success: results && results.length === launchIds.length,
                message: launchIds.length ? 'trips booked successfully' : `the following launches couldn't be booked: ${launchIds.filter( id => !results.includes(id) )}`,
                launches
            }
        },
        cancelTrip: async (_, { launchId }, { dataSources }) => {
            const result = await dataSources.userAPI.cancelTrip({ launchId });
            if (!result)
              return {
                success: false,
                message: 'failed to cancel trip',
              };
            const launch = await dataSources.launchAPI.getLaunchById({ launchId });
            return {
              success: true,
              message: 'trip cancelled',
              launches: [launch],
            };
        }
    }
};
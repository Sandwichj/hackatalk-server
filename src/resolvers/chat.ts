import { Resolvers } from '../generated/graphql';

const resolver: Resolvers = {
  Query: {
    chats: async (
      _,
      args, {
        models,
      },
    ) => {
      const { Chat } = models;

      return Chat.findAll({
        chatroomId: 1,
      });
    },
  },
};

export default resolver;

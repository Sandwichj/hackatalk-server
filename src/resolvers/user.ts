import * as jwt from 'jsonwebtoken';

import { Resolvers, UserResolvers } from '../generated/graphql';
import { checkPassword, encryptPassword } from '../utils/encryption';

import { AuthenticationError } from 'apollo-server-express';
import { Role } from '../types';
import { withFilter } from 'apollo-server';

type Token = string;

const USER_ADDED = 'USER_ADDED';
const USER_UPDATED = 'USER_UPDATED';
const SOCIAL_NAME = {
  GOOGLE: 'google',
  FACEBOOK: 'facebook',
};

const hasUser = (user) => {
  return !user || (user && user[1] === false);
};

const isSignedIn = async ({ User }, user, queryOptions = {}) => {
  const {
    email,
  } = user;

  const emailUser = User.findOne({
    raw: true,
    where: {
      email,
    },
    ...queryOptions,
  });

  if (emailUser) {
    return true;
  }

  return false;
};

const isSignedInBySocial = async ({
  User,
},
  socialUser,
  socialName,
) => {
  const {
    email,
  } = socialUser;

  return isSignedIn({ User }, socialUser, {
    where: {
      email,
      social: { $notLike: `${socialName}%` },
    },
  });
};

const getOrSignUp = async ({
  User,
},
  socialUser,
  socialName,
) => {
  const {
    email,
    name,
    nickname,
    photo,
    birthday,
    gender,
    phone,
    social,
  } = socialUser;

  const foundUser = User.findOrCreate({
    where: { social: `${socialName}_${social}` },
    defaults: {
      social: `${socialName}_${social}`,
      email,
      name,
      nickname,
      photo,
      birthday,
      gender,
      phone,
      verified: email || false,
    },
    raw: true,
  });

  if (hasUser(foundUser)) {
    return foundUser[0];
  }

  return null;
};

const signIn = (userId, appSecret): Token => jwt.sign({
  userId,
  role: Role.User,
},
appSecret,
);

const resolver: Resolvers = {
  Query: {
    users: async (_, args, { getUser, models }, info) => {
      const user = await getUser();
      if (!user) throw new AuthenticationError('User is not logged in');
      return models.User.findAll();
    },
    user: (_, args, { models }) => models.User.findOne({ where: args }),
  },
  Mutation: {
    signInGoogle: async (
      _, {
        socialUser,
      }, {
        appSecret,
        models,
      }) => {
      const { email } = socialUser;
      const { User } = models;

      try {
        if (email) {
          const signedIn = await isSignedInBySocial({ User }, socialUser, SOCIAL_NAME.GOOGLE);

          if (signedIn) {
            throw new Error('Email for current user is already signed in');
          }
        }

        const user = await getOrSignUp({ User }, socialUser, SOCIAL_NAME.GOOGLE);

        if (!user) {
          throw new Error('Failed to sign up.');
        }

        const { id: userId } = user;
        const token: Token = signIn(userId, appSecret);

        return {
          token,
          user,
        };
      } catch (err) {
        throw new Error(err);
      }
    },
    signInFacebook: async (
      _, {
        socialUser,
      }, {
        appSecret,
        models,
      }) => {
      const { email } = socialUser;
      const { User } = models;

      try {
        if (email) {
          const signedIn = await isSignedInBySocial({ User }, socialUser, SOCIAL_NAME.FACEBOOK);

          if (signedIn) {
            throw new Error('Email for current user is already signed in');
          }
        }

        const user = await getOrSignUp({ User }, socialUser, SOCIAL_NAME.FACEBOOK);

        if (!user) {
          throw new Error('Failed to sign up.');
        }

        const { id: userId } = user;
        const token: Token = signIn(userId, appSecret);

        return {
          token,
          user,
        };
      } catch (err) {
        throw new Error(err);
      }
    },
    signUp: async (
      _, {
        user,
      }, {
        appSecret,
        models,
        pubsub,
      }) => {
      const { password } = user;
      const { User } = models;
      const signedIn = await isSignedIn({ User }, user);

      if (signedIn) {
        throw new Error('Email for current user is already signed in');
      }

      const encryptedPassword = await encryptPassword(password);
      const userToCreate = {
        ...user,
        password: encryptedPassword,
      };

      const createdUser = await models.User.create(userToCreate, { raw: true });
      const token: string = jwt.sign({
        userId: createdUser.id,
        role: Role.User,
      },
      appSecret,
      );

      pubsub.publish(USER_ADDED, {
        userAdded: createdUser,
      });

      return { token, user: createdUser };
    },
    updateProfile: async (_, args, { appSecret, getUser, models, pubsub }) => {
      try {
        const auth = await getUser();
        if (auth.id !== args.user.id) {
          throw new AuthenticationError(
            'User can update his or her own profile',
          );
        }
        models.User.update(
          args,
          {
            where: {
              id: args.user.id,
            },
          },
          { raw: true },
        );

        const user = await models.User.findOne({
          where: {
            id: args.user.id,
          },
          raw: true,
        });

        pubsub.publish(USER_UPDATED, { user });
        return user;
      } catch (err) {
        throw new Error(err);
      }
    },
  },
  Subscription: {
    userAdded: {
      subscribe: (_, args, { pubsub }) => pubsub.asyncIterator(USER_ADDED),
    },
    userUpdated: {
      subscribe: withFilter(
        (_, args, { pubsub }) => pubsub.asyncIterator(USER_UPDATED),
        (payload, variables) => {
          return payload.userUpdated.id === variables.id;
        },
      ),
    },
  },
  User: {
    notifications: (_, args, { models }, info) => {
      return models.Notification.findAll({
        where: {
          userId: _.id,
        },
      });
    },
    reviews: (_, args, { models }, info) => {
      return models.Review.findAll({
        where: {
          userId: _.id,
        },
      });
    },
  },
};

export default resolver;

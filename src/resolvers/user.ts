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

const getUser = async ({ User }, id) => {
  return User.findOne({
    where: {
      id,
    },
    raw: true,
  });
};

const hasUser = (user) => {
  return !user || (user && user[1] === false);
};

const isValidUser = (signedInUser, user) => signedInUser.id === user.id;

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

const udpateUser = async ({
  User,
},
  id,
  userData,
) => {
  return User.update(
    userData, {
      where: {
        id,
      },
    },
    { raw: true },
  );
};

const getNotificationsByUserId = ({ Notification }, userId) => {
  return Notification.findAll({
    where: {
      userId,
    },
  });
};

const getReviewsByUserId = ({ Review }, userId) => {
  return Review.findAll({
    where: {
      userId,
    },
  });
};

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
    updateProfile: async (
      _,
      args, {
        getUser: getSignedInUser,
        models,
        pubsub,
      }) => {
      const { User } = models;
      const { user } = args;
      const { id } = user;
      const signedInUser = await getSignedInUser();

      try {
        if (!isValidUser(signedInUser, user)) {
          throw new AuthenticationError(
            'User can update his or her own profile',
          );
        }

        const updatedUser = await udpateUser({ User }, id, args);
        pubsub.publish(USER_UPDATED, { updatedUser });

        return updatedUser;
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
        (payload, user) => {
          const { userUpdated: updatedUser } = payload;

          return updatedUser.id === user.id;
        },
      ),
    },
  },
  User: {
    notifications: (user, args, { models }) => {
      const { id } = user;
      const { Notification } = models;

      return getNotificationsByUserId({ Notification }, id);
    },
    reviews: (user, args, { models }) => {
      const { id } = user;
      const { Review } = models;

      return getReviewsByUserId({ Review }, id);
    },
  },
};

export default resolver;

import { GraphQLClient, request } from 'graphql-request';

import { testHost } from './testSetup';

describe('Resolver - Gallery', () => {
  let client: GraphQLClient;
  const signUpUser = /* GraphQL */`
    mutation {
      signUp(user: {
        email: "test-2@dooboo.com"
        password: "test-2"
        name: "test-2"
      }) {
        token,
        user {
          email
        }
      }
    }
  `;

  const galleries = /* GraphQL */`
    query {
      galleries(
        userId: "user_id"
      ) {
        id,
        photoURL,
      }
    }
  `;

  beforeAll(async () => {
    const { signUp } = await request(testHost, signUpUser);
    client = new GraphQLClient(testHost, {
      headers: {
        authorization: signUp.token,
      },
    });
  });

  it('should query galleries', async () => {
    const response = await client.request(galleries);

    expect(response).toHaveProperty('galleries');
    expect(response.galleries).toEqual([]);
  });

  const createGallery = /* GraphQL */`
    mutation createGallery(
      $photoURL: String!
    ) {
      createGallery(photoURL: $photoURL) {
        photoURL,
      }
    }
  `;

  it('should create gallery', async () => {
    const variables = {
      photoURL: 'http://',
    };
    const response = await client.request(createGallery, variables);

    expect(response).toHaveProperty('createGallery');
    expect(response.createGallery).toEqual({ photoURL: variables.photoURL });
  });

  const updateGallery = /* GraphQL */`
    mutation updateGallery(
      $galleryId: ID!
      $photoURL: String!
    ) {
      updateGallery(galleryId: $galleryId photoURL: $photoURL)
    }
  `;

  it('should update gallery', async () => {
    const variables = {
      galleryId: 'test',
      photoURL: 'http://',
    };
    const promise = client.request(updateGallery, variables);

    expect(promise).resolves.toEqual({
      updateGallery: 0,
    });
  });

  const deleteGallery = /* GraphQL */`
    mutation deleteGallery(
      $galleryId: ID!
    ) {
      deleteGallery(galleryId: $galleryId)
    }
  `;

  it('should delete gallery', async () => {
    const variables = {
      galleryId: 'test',
    };
    const promise = client.request(deleteGallery, variables);

    expect(promise).resolves.toEqual({
      deleteGallery: 0,
    });
  });

  it('should throw errors during when urls are not valid', () => {
    const variables = {
      photoURL: 'error://',
    };
    const promise = client.request(createGallery, variables);
    expect(promise).rejects.toThrow('photoURL is not a url. It should start with http.');
  });
});

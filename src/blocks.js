/**
 * Stores whether ```plantuml code blocks are converted to diagrams in one issue or article.
 * The plantuml-blocks widget reads the flag after each load and changes it on the user's request.
 */

const ON = 'true';

const state = (entity) => ({enabled: entity.extensionProperties.plantumlConvert === ON});

const setState = (ctx, entity) => {
  const body = ctx.request.json();
  if (typeof body.enabled !== 'boolean') {
    ctx.response.code = 400;
    ctx.response.json({error: 'Invalid request'});
    return;
  }
  entity.extensionProperties.plantumlConvert = body.enabled ? ON : null;
  ctx.response.json(state(entity));
};

exports.httpHandler = {
  endpoints: [
    {
      scope: 'ISSUE',
      method: 'GET',
      path: 'issue/state',
      permissions: ['UPDATE_ISSUE'],
      handle: (ctx) => ctx.response.json(state(ctx.issue))
    },
    {
      scope: 'ISSUE',
      method: 'POST',
      path: 'issue/state',
      permissions: ['UPDATE_ISSUE'],
      handle: (ctx) => setState(ctx, ctx.issue)
    },
    {
      scope: 'ARTICLE',
      method: 'GET',
      path: 'article/state',
      permissions: ['UPDATE_ARTICLE'],
      handle: (ctx) => ctx.response.json(state(ctx.article))
    },
    {
      scope: 'ARTICLE',
      method: 'POST',
      path: 'article/state',
      permissions: ['UPDATE_ARTICLE'],
      handle: (ctx) => setState(ctx, ctx.article)
    }
  ]
};

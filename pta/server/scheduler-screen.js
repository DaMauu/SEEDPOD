/* 初筛阶段：调用 screenCatalog，再跑 screen hooks。 */
function makeScreenPhase() {
  return async function runScreenPhase(o) {
    const { want, screen, ctx, screenLimit, pipeline, steps } = o;
    if (!want('screen')) return { screen: { skipped: 'step not selected' }, hooks: undefined };
    const out = screen.screenCatalog(ctx, { limit: screenLimit });
    const hooks = await pipeline.run('screen', ctx, steps);
    return { screen: out, hooks: hooks };
  };
}

module.exports = { makeScreenPhase };

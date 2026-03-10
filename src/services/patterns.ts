import { getLevelsVariable } from './variableGetters';
import { ServiceScene } from 'Components/ServiceScene/ServiceScene';

export function getPatternsCount(serviceScene: ServiceScene) {
  const patternsData = serviceScene.state.$patternsData?.state.data?.series;
  if (!patternsData) {
    return 0;
  }

  let patterns = patternsData;

  const levelsVariable = getLevelsVariable(serviceScene);
  if (levelsVariable.state.filters.length > 0) {
    const levels = levelsVariable.state.filters.map((filter) => filter.value);
    patterns = patterns.filter((pattern) =>
      pattern.meta?.custom?.level?.some?.((level: string) => levels.includes(level))
    );
  }

  return patterns.length;
}

import { usePluginFunctions } from '@grafana/runtime';

export const FunctionContext = () => {
  // get all exposed functions from the assistant plugin
  const { functions: assistantFunctions } = usePluginFunctions({
    extensionPointId: 'grafana-assistant-app/grafana-core-callback/v0-alpha',
  });

  console.log('assistantFunctions LOGS DRILLDOWN', assistantFunctions);

  return null;
};

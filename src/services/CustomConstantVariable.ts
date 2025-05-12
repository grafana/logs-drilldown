import { Observable, of } from 'rxjs';

import {
  MultiOrSingleValueSelect,
  MultiValueVariable,
  MultiValueVariableState,
  SceneComponentProps,
  VariableGetOptionsArgs,
  VariableValueOption,
  VariableValueSingle,
} from '@grafana/scenes';

export interface CustomConstantVariableState extends MultiValueVariableState {
  isMulti?: false;
  value: VariableValueSingle;
}

export class CustomConstantVariable extends MultiValueVariable<CustomConstantVariableState> {
  public constructor(initialState: Partial<CustomConstantVariableState>) {
    super({
      name: '',
      options: [],
      text: '',
      type: 'custom',
      value: '',
      ...initialState,
    });
  }

  public getValueOptions(args: VariableGetOptionsArgs): Observable<VariableValueOption[]> {
    return of(this.state.options);
  }
  public static Component = ({ model }: SceneComponentProps<MultiValueVariable>) => {
    return MultiOrSingleValueSelect({ model });
  };
}

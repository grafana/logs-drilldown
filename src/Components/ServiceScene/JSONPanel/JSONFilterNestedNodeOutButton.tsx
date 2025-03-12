import {IconButton} from "@grafana/ui";
import React from "react";
import {KeyPath} from "@gtk-grafana/react-json-tree";
import {AdHocVariableFilter, DataFrame} from "@grafana/data";
import {NodeTypeLoc} from "../LogsJsonScene";
import {getJsonKey} from "../../../services/filters";
import {EMPTY_VARIABLE_VALUE} from "../../../services/variables";
import {FilterOp} from "../../../services/filterTypes";

interface Props {
    keyPath: KeyPath,
    nodeTypeLoc: NodeTypeLoc
    dataFrame: DataFrame
    addFilter: (keyPath: KeyPath, filter: AdHocVariableFilter, nodeType: NodeTypeLoc, dataFrame: DataFrame | undefined) => void
}

export function JSONFilterNestedNodeOutButton({addFilter, keyPath, nodeTypeLoc, dataFrame}: Props) {
    return <IconButton
        tooltip={`Exclude log lines that contain ${keyPath[0]}`}
        // className={styles.filterButton}
        onClick={(e) => {
            e.stopPropagation();
            addFilter(
                keyPath,
                {
                    key: getJsonKey(keyPath),
                    value: EMPTY_VARIABLE_VALUE,
                    operator: FilterOp.Equal,
                },
                nodeTypeLoc,
                dataFrame
            );
        }}
        size={'md'}
        name={'minus-circle'}
        aria-label={'remove filter'}
    />;
}

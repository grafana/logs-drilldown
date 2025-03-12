import {KeyPath} from "@gtk-grafana/react-json-tree";
import {IconButton, useStyles2} from "@grafana/ui";
import React from "react";
import {GrafanaTheme2} from "@grafana/data";
import {css} from "@emotion/css";

export function DrilldownButton({keyPath, addDrilldown}: {keyPath: KeyPath, addDrilldown: (keyPath: KeyPath) => void}) {
    const styles = useStyles2(getStyles)
    return <IconButton
        className={styles.filterButton}
        tooltip={`Set ${keyPath[0]} as root node`}
        onClick={(e) => {
            e.stopPropagation();
            addDrilldown(keyPath)
        }}
        size={'md'}
        name={'angle-double-down'}
        aria-label={`drilldown into ${keyPath[0]}`}
    />;
}

const getStyles = (theme: GrafanaTheme2) => {
    return {
        filterButton: css({
        }),
    }
}

import React from 'react';

import { t } from '@grafana/i18n';
import { SceneComponentProps, SceneObject, SceneObjectBase, SceneObjectState } from '@grafana/scenes';
import { LinkButton } from '@grafana/ui';

import { getExploreLink } from './PanelMenu';
import { reportAppInteraction, USER_EVENTS_ACTIONS, USER_EVENTS_PAGES } from 'services/analytics';
import { testIds } from 'services/testIds';

interface LinkToExploreState extends SceneObjectState {}

interface ExploreLinkButtonProps {
  className?: string;
  href: string;
  onClick?: () => void;
}

export const ExploreLinkButton = (props: ExploreLinkButtonProps) => {
  return (
    <LinkButton
      className={props.className}
      data-testid={testIds.linkToExplore.btn}
      variant="secondary"
      fill="outline"
      size="sm"
      icon="compass"
      href={props.href}
      onClick={props.onClick}
    >
      {t('panels.link-to-explore.button', 'Explore')}
    </LinkButton>
  );
};

export class LinkToExplore extends SceneObjectBase<LinkToExploreState> {
  public static Component = ({ model }: SceneComponentProps<LinkToExplore>) => {
    const href = getLinkToExploreSafe(model);
    if (!href) {
      return null;
    }

    return <ExploreLinkButton href={href} onClick={onLinkToExploreClick} />;
  };
}

export const onLinkToExploreClick = () => {
  reportAppInteraction(USER_EVENTS_PAGES.all, USER_EVENTS_ACTIONS.all.open_in_explore_menu_clicked);
};

export const getLinkToExploreSafe = (sceneRef: SceneObject): string | undefined => {
  try {
    return getExploreLink(sceneRef);
  } catch {
    return undefined;
  }
};

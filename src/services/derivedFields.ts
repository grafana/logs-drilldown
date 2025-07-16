import { Field } from '@grafana/data';

export type JSONDerivedFieldLink = { href: string; name: string };
export function getJsonDerivedFieldsLinks(derivedFields: Field[], valueRowIndex: number) {
  let jsonLinks: Record<string, string> = {};
  derivedFields.forEach((derivedField) => {
    const links = derivedField?.getLinks?.({ valueRowIndex });
    links?.forEach((link) => {
      if (link.href) {
        let title = link.title;
        let name = link.origin.name;
        let increment = 1;
        // Do we already have a link with this title?
        if (jsonLinks[title]) {
          // If so let's generate a unique name
          title = title + ' ' + (increment++).toString();
        }

        // If the field the link targets is not falsy
        if (link.origin.values[valueRowIndex]) {
          // We need to encode the value as a string otherwise
          const payload: JSONDerivedFieldLink = { href: link.href, name };
          jsonLinks[title] = JSON.stringify(payload);
        }
      }
    });
  });
  return jsonLinks;
}

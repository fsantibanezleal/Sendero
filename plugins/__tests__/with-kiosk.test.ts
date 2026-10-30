import { addKioskToManifest } from '../with-kiosk';

function manifestFixture() {
  return {
    manifest: {
      application: [
        {
          activity: [
            {
              $: { 'android:name': '.MainActivity', 'android:exported': 'true' } as Record<string, string>,
              'intent-filter': [
                {
                  action: [{ $: { 'android:name': 'android.intent.action.MAIN' } }],
                  category: [{ $: { 'android:name': 'android.intent.category.LAUNCHER' } }],
                },
              ],
            },
          ],
        },
      ],
    },
  };
}

type Fixture = ReturnType<typeof manifestFixture>;
type Filter = Fixture['manifest']['application'][0]['activity'][0]['intent-filter'][0];

function filters(manifest: Fixture): Filter[] {
  return manifest.manifest.application[0].activity[0]['intent-filter'];
}

const hasCategory = (f: Filter, name: string) =>
  (f.category ?? []).some((c) => c.$['android:name'] === name);

describe('with-kiosk manifest edit', () => {
  it('adds a separate HOME and DEFAULT filter, keeps LAUNCHER, sets lockTaskMode', () => {
    const m = addKioskToManifest(manifestFixture()) as Fixture;
    const list = filters(m);
    expect(list).toHaveLength(2);
    expect(hasCategory(list[0], 'android.intent.category.LAUNCHER')).toBe(true);
    const home = list.find((f) => hasCategory(f, 'android.intent.category.HOME'));
    expect(home).toBeDefined();
    expect(hasCategory(home as Filter, 'android.intent.category.DEFAULT')).toBe(true);
    expect((home as Filter).action[0].$['android:name']).toBe('android.intent.action.MAIN');
    expect(hasCategory(home as Filter, 'android.intent.category.LAUNCHER')).toBe(false);
    expect(m.manifest.application[0].activity[0].$['android:lockTaskMode']).toBe('if_whitelisted');
  });

  it('is idempotent: two applications add the HOME filter once', () => {
    const once = addKioskToManifest(manifestFixture());
    const twice = addKioskToManifest(once) as Fixture;
    expect(filters(twice)).toHaveLength(2);
    expect(
      filters(twice).filter((f) => hasCategory(f, 'android.intent.category.HOME')),
    ).toHaveLength(1);
    expect(twice.manifest.application[0].activity[0].$['android:lockTaskMode']).toBe('if_whitelisted');
  });

  it('throws when MainActivity is missing', () => {
    expect(() => addKioskToManifest({ manifest: { application: [{ activity: [] }] } })).toThrow(
      /MainActivity/,
    );
  });
});

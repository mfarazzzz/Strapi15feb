import { PLUGIN_ID } from './pluginId';

const HomePage = () => {
  return (
    <div style={{ padding: '20px' }}>
      <h1>RBAC Manager</h1>
      <p>Loading...</p>
    </div>
  );
};

export default {
  register(app: any) {
    app.registerPlugin({
      id: PLUGIN_ID,
      name: 'RBAC Manager',
    });
  },

  bootstrap(app: any) {
    app.addMenuLink({
      to: `/plugins/${PLUGIN_ID}`,
      icon: 'User',
      label: 'यूजर (RBAC)',
      position: 2,
    });

    app.addRoutes([
      {
        path: `/plugins/${PLUGIN_ID}`,
        name: PLUGIN_ID,
        component: HomePage,
      },
    ]);
  },
};

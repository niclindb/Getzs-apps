import React from 'react'

import { Text, Screen, ScrollView, Navigator, reactExtension } from '@shopify/ui-extensions-react/point-of-sale'

const Modal = () => {
  return (
    <Navigator>
      <Screen name="HoldOrder" title="Hold Order">
        <ScrollView>
          <Text>Welcome to the extension!</Text>
        </ScrollView>
      </Screen>
    </Navigator>
  )
}

export default reactExtension('pos.home.modal.render', () => <Modal />);
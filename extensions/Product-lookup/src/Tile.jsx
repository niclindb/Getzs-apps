import React from 'react'

import { Tile, reactExtension, useApi } from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {
  const api = useApi();

  return (
      <Tile
          title="Price Product"
          onPress={() => {
            api.action.presentModal()
          }}
        enabled />
  )
}
export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})
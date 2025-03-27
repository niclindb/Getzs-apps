import React from 'react'
import { Tile, reactExtension, useApi, useCartSubscription} from '@shopify/ui-extensions-react/point-of-sale'

const TileComponent = () => {
  const api = useApi()
  const cart = useCartSubscription();
  return (
    <Tile
      title="Charge Order"
      onPress={() => {
        api.action.presentModal()
        
      }}
      enabled
    />
  )
}

export default reactExtension('pos.home.tile.render', () => {
  return <TileComponent />
})
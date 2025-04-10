package SIREN

import (
	"fmt"

	"github.com/engelsjk/polygol"
	geojson "github.com/paulmach/go.geojson"
	"github.com/paulmach/orb"
	"github.com/paulmach/orb/simplify"
)

type UGC struct {
	UGC   string  `msgpack:"UGC"`
	Lat   float64 `msgpack:"lat"`
	Lon   float64 `msgpack:"lon"`
	Name  string  `msgpack:"name"`
	State string  `msgpack:"state"`
	// This is either a [][2]float64 or a [][][2]float64
	Feature any `msgpack:"feature"`
}

type AbstractGeom = polygol.Geom // This is a [][][][]float64

// UnionPolygons takes a slice of polygons and multipolygons and returns their union as a multipolygon.
func UnionPolygons(geoms []AbstractGeom) AbstractGeom {
	res, err := polygol.Union(geoms[0], geoms[1:]...)
	if err != nil {
		return nil
	}
	if len(res) == 0 {
		return nil
	}
	return res
}

func SimplifyMultiPolygon(geom AbstractGeom, tolerance float64) AbstractGeom {
	var mp orb.MultiPolygon
	for _, polygon := range geom {
		var poly orb.Polygon
		for _, ring := range polygon {
			var orbRing orb.Ring
			for _, pt := range ring {
				if len(pt) < 2 {
					continue
				}
				orbRing = append(orbRing, orb.Point{pt[0], pt[1]})
			}
			poly = append(poly, orbRing)
		}
		mp = append(mp, poly)
	}

	simplified := orb.Simplifier.MultiPolygon(simplify.VisvalingamThreshold(0.0005), mp)
	if len(simplified) == 0 {
		return nil
	}

	// Convert back to the original format

	var converted AbstractGeom
	for _, polygon := range simplified {
		var newPolygon [][][]float64
		for _, ring := range polygon {
			var newRing [][]float64
			for _, pt := range ring {
				newRing = append(newRing, []float64{pt[0], pt[1]})
			}
			newPolygon = append(newPolygon, newRing)
		}
		converted = append(converted, newPolygon)
	}

	return converted
}

// ConvertToPolygon attempts to convert an interface{} into a simple polygon,
// which is defined as a slice of [2]float64.
func ConvertToPolygon(feature any) ([][2]float64, error) {
	arr, ok := feature.([]any)
	if !ok {
		return nil, fmt.Errorf("expected []interface{} for polygon")
	}

	var polygon [][2]float64
	for _, point := range arr {
		ptArr, ok := point.([]any)
		if !ok || len(ptArr) != 2 {
			return nil, fmt.Errorf("each point must be a slice of 2 items")
		}

		var pt [2]float64
		for j, val := range ptArr {
			f, ok := val.(float64)
			if !ok {
				return nil, fmt.Errorf("point coordinates must be float64")
			}
			pt[j] = f
		}
		polygon = append(polygon, pt)
	}
	return polygon, nil
}

// ConvertToMultiPolygon converts the feature into a multipolygon,
// defined as a slice of simple polygons.
func ConvertToMultiPolygon(feature any) ([][][2]float64, error) {
	arr, ok := feature.([]any)
	if !ok {
		return nil, fmt.Errorf("expected []interface{} for multipolygon")
	}

	var multiPolygon [][][2]float64
	for _, poly := range arr {
		// Each polygon should be convertible with convertToPolygon.
		polygon, err := ConvertToPolygon(poly)
		if err != nil {
			return nil, fmt.Errorf("failed to convert inner polygon: %w", err)
		}
		multiPolygon = append(multiPolygon, polygon)
	}
	return multiPolygon, nil
}

func CreateGeoJSON(geometry []AlertGeometry) geojson.FeatureCollection {
	collection := geojson.NewFeatureCollection()

	for _, geom := range geometry {
		geoGeom := geojson.NewMultiPolygonGeometry(geom.Coordinates...)
		feature := geojson.NewFeature(geoGeom)
		feature.Properties["id"] = geom.Identifier
		feature.Properties["color"] = ColorMap[geom.Identifier[0:3]]
		if feature.Properties["color"] == "" {
			feature.Properties["color"] = "#EFEFEF"
		}

		collection.AddFeature(feature)
	}

	return *collection
}

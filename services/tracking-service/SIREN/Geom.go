package SIREN

import (
	"fmt"
	"math"

	"github.com/ctessum/polyclip-go"
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

// Using an empty struct reduces memory usage.
var states = map[string]struct{}{
	"AL": {}, "AK": {}, "AZ": {}, "AR": {},
	"CA": {}, "CO": {}, "CT": {}, "DE": {},
	"FL": {}, "GA": {}, "HI": {}, "ID": {},
	"IL": {}, "IN": {}, "IA": {}, "KS": {},
	"KY": {}, "LA": {}, "ME": {}, "MD": {},
	"MA": {}, "MI": {}, "MN": {}, "MS": {},
	"MO": {}, "MT": {}, "NE": {}, "NV": {},
	"NH": {}, "NJ": {}, "NM": {}, "NY": {},
	"NC": {}, "ND": {}, "OH": {}, "OK": {},
	"OR": {}, "PA": {}, "RI": {}, "SC": {},
	"SD": {}, "TN": {}, "TX": {}, "UT": {},
	"VT": {}, "VA": {}, "WA": {}, "WV": {},
	"WI": {}, "WY": {},
}

func IsState(s string) bool {
	if len(s) != 2 {
		return false
	}
	_, ok := states[s]
	return ok
}

type GeoJSONPolygon = [][2]float64
type GeoJSONMultiPolygon = []GeoJSONPolygon

// convertToPolygon converts a GeoJSON polygon to a polyclip.Polygon
func convertPolygon(polygon GeoJSONPolygon) polyclip.Polygon {
	contour := make([]polyclip.Point, len(polygon))
	for i, pt := range polygon {
		contour[i] = polyclip.Point{X: pt[0], Y: pt[1]}
	}
	return polyclip.Polygon{contour}.MakeValid()
}

// convertMultiPolygon converts a GeoJSON multipolygon to a polyclip.Polygon
func convertMultiPolygon(multiPolygon GeoJSONMultiPolygon) polyclip.Polygon {
	var poly polyclip.Polygon
	for _, polygon := range multiPolygon {
		contour := make([]polyclip.Point, len(polygon))
		for i, pt := range polygon {
			contour[i] = polyclip.Point{X: pt[0], Y: pt[1]}
		}
		poly = append(poly, contour)
	}

	return poly.MakeValid()
}

// UnionPolygons takes a slice of polygons and multipolygons and returns their union as a multipolygon.
func UnionPolygons(polygons []GeoJSONPolygon, multipolygons []GeoJSONMultiPolygon, tol float64) GeoJSONMultiPolygon {
	var union polyclip.Polygon
	for _, polyCoordinates := range polygons {
		poly := convertPolygon(polyCoordinates)
		if len(union) == 0 {
			union = poly
		} else {
			union = union.Construct(polyclip.UNION, poly)
		}
	}

	for _, multiPolyCoordinates := range multipolygons {
		multiPoly := convertMultiPolygon(multiPolyCoordinates)
		if len(union) == 0 {
			union = multiPoly
		} else {
			union = union.Construct(polyclip.UNION, multiPoly)
		}
	}

	union = SimplifyPolygon(union, tol)

	var result GeoJSONMultiPolygon
	for _, polygon := range union {
		var coords GeoJSONPolygon
		for _, pt := range polygon {
			coords = append(coords, [2]float64{pt.X, pt.Y})
		}
		// Ensure the polygon is closed by appending the first point at the end
		if len(coords) > 0 {
			coords = append(coords, coords[0])
		}
		result = append(result, coords)
	}

	return result
}

// ConvertToPolygon attempts to convert an interface{} into a simple polygon,
// which is defined as a slice of [2]float64.
func ConvertToPolygon(feature any) ([][2]float64, error) {
	arr, ok := feature.([]interface{})
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

/*================== Douglas–Peucker algorithm implementation =================*/

func perpDistance(p, start, end polyclip.Point) float64 {
	dx := end.X - start.X
	dy := end.Y - start.Y
	if dx == 0 && dy == 0 {
		return math.Hypot(p.X-start.X, p.Y-start.Y)
	}

	t := ((p.X-start.X)*dx + (p.Y-start.Y)*dy) / (dx*dx + dy*dy)

	closeX := start.X + t*dx
	closeY := start.Y + t*dy
	return math.Hypot(p.X-closeX, p.Y-closeY)
}

func simplify(points []polyclip.Point, tolerance float64) []polyclip.Point {
	if len(points) < 3 {
		return points
	}

	maxDist := 0.0
	index := 0

	for i := 1; i < len(points)-1; i++ {
		dist := perpDistance(points[i], points[0], points[len(points)-1])
		if dist > maxDist {
			index = i
			maxDist = dist
		}
	}

	if maxDist > tolerance {
		//Scary recursive call
		left := simplify(points[:index+1], tolerance)
		right := simplify(points[index:], tolerance)

		return append(left[:len(left)-1], right...)
	}

	return []polyclip.Point{points[0], points[len(points)-1]}
}

func SimplifyPolygon(polygon polyclip.Polygon, tolerance float64) polyclip.Polygon {
	simplified := make(polyclip.Polygon, len(polygon))
	for i, contour := range polygon {
		simplified[i] = simplify(contour, tolerance)
	}
	return simplified
}

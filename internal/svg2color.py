from xml.dom import minidom
import json
import sys
import re
import copy

# This script makes it easy to generate new color schemes for maps. First,
# download the map you want to edit as an SVG. Then, assign the new background
# colors that you want. Then, run this script as follows:
#
# python svg2color.py [edited-map.svg] [default-colors.json]
#
# The script will then produce a new color JSON definition on stdout.

class NotAValidRegionException(Exception):
    pass

class_region_id_re = re.compile(r'path-.*-([0-9]+)')
linear_gradient_fill_re = re.compile(r'url\(#(.*)\)')

def parse_inline_css(inline_css):

    css_properties = {}

    for prop in inline_css.split(";"):

        prop_def = prop.split(":")

        if len(prop_def) != 2:
            continue

        css_properties[prop_def[0].strip()] = prop_def[1].strip()
    
    return css_properties

def get_path_region_id(class_attr):

    classes = class_attr.split(" ")

    for clss in classes:
        
        match = class_region_id_re.match(clss)

        if match is not None:

            return int(match.group(1))
    
    raise NotAValidRegionException()

def get_color_from_linear_gradient(lgs, lg_id):

    if lgs[lg_id]['link']:
        return get_color_from_linear_gradient(lgs, lgs[lg_id]['value'])
    else:
        return lgs[lg_id]['value']

colors = {}
svg_map = minidom.parse(sys.argv[1])

with open(sys.argv[2], 'r') as default_colors_file:
    colors = json.load(default_colors_file)

original_colors = copy.deepcopy(colors)

# For some reason, Inkscape likes to define solid colors as linear gradients.
# Therefore, we have to handle them here *sigh*
linear_gradients = {}

for linear_gradient in svg_map.getElementsByTagName("linearGradient"):

    if not linear_gradient.hasAttribute("id"):
        continue

    # First, we see if this gradient links to another one instead of defining
    # its own color

    if linear_gradient.hasAttribute("xlink:href"):

        link_id = linear_gradient.getAttribute("xlink:href")

        if link_id[0] == '#':
            link_id = link_id[1:]
        
        linear_gradients[linear_gradient.getAttribute("id")] = {'link': True, 'value': link_id}

        continue

    # Otherwise, we take the color from the 0 (or 0%) stop

    for stop in linear_gradient.getElementsByTagName("stop"):

        if stop.getAttribute("offset") == "0" or stop.getAttribute("offset") == "0%":

            css_properties = parse_inline_css(stop.getAttribute("style"))
            linear_gradients[linear_gradient.getAttribute("id")] = {'link': False, 'value': css_properties["stop-color"]}


for path in svg_map.getElementsByTagName("path"):

    # First, see if we have a valid region
    try:
        region_id = get_path_region_id(path.getAttribute("class"))
    except NotAValidRegionException:
        continue
    
    # Next, see if its ID is in the color definition
    if 'id_{}'.format(region_id) not in colors:
        print("ID {} is not a valid ID.".format(region_id))
        continue
    
    # Now, update the color if necessary. If the color specified in the SVG
    # file is the same as the original color, then we don't update.
    # This makes it easier to color maps with many small polygons. We only
    # need to update the color for one polygon in a region for the region's
    # color to be updated.

    new_color = path.getAttribute("fill").lower()

    # We have to check inline CSS too *sigh*
    # Our inline CSS parser is very basic, but it should do

    if path.hasAttribute("style"):

        css_properties = parse_inline_css(path.getAttribute("style"))

        if "fill" in css_properties:

            linear_gradient_match = linear_gradient_fill_re.match(css_properties["fill"])

            if linear_gradient_match is not None:
                new_color = get_color_from_linear_gradient(linear_gradients, linear_gradient_match.group(1))
            else:
                new_color = css_properties["fill"]

    if original_colors['id_{}'.format(region_id)].lower() != new_color:
        print("Updating color for region {} (original color {}, new color {})".format(region_id, original_colors['id_{}'.format(region_id)], new_color))
        colors['id_{}'.format(region_id)] = new_color
    else:
        print("Did not get new color for region {} (original color {}, new color {})".format(region_id, original_colors['id_{}'.format(region_id)], new_color))

print(json.dumps(colors))
    





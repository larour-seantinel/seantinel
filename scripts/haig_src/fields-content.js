'use strict';

(function(vesl, $, undefined) {
	/* Public variables */
	vesl.fieldsContent = {
		'1'				: { // Velocity
			'colorbarHeadings'	: {
				'scientist' 		: {
					'long'				: 'Velocity',
					'short'				: 'V'
				},
				'public' 			: {
					'long'				: 'Velocity',
					'short'				: 'V'
				}
			},
			'label'				: {
				'scientist' 		: 'Velocity',
				'public' 			: 'Velocity'
			},
			'unitSystems'		: {
				'scientist' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
				},
				'public' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
					
				}
			}
		},
		'2'				: { // Thickness
			'colorbarHeadings'	: {
				'scientist' 		: {
					'long'				: 'Thickness',
					'short'				: 'H'
				},
				'public' 			: {
					'long'				: 'Thickness',
					'short'				: 'V'
				}
			},
			'label'				: {
				'scientist' 		: 'Thickness',
				'public' 			: 'Thickness'
			},
			'unitSystems'		: {
				'scientist' 		: {
					'international'		: 'm',
					'imperial'			: 'ft'
				},
				'public' 		: {
					'international'		: 'm',
					'imperial'			: 'ft'
					
				}
			}
		},
		'3'				: { // Velocity change
			'colorbarHeadings'	: {
				'scientist' 		: {
					'long'				: 'Velocity Change',
					'short'				: '&Delta;V'
				},
				'public' 			: {
					'long'				: 'Velocity Change',
					'short'				: '&Delta;V'
				}
			},
			'label'				: {
				'scientist' 		: 'Velocity Change',
				'public' 			: 'Velocity Change'
			},
			'unitSystems'		: {
				'scientist' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
				},
				'public' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
					
				}
			}
		},
		'4'				: { // Thickness change
			'colorbarHeadings'	: {
				'scientist' 		: {
					'long'				: 'Thickness Change',
					'short'				: '&Delta;H'
				},
				'public' 			: {
					'long'				: 'Thickness Change',					
					'short'				: '&Delta;H'
				}
			},
			'label'				: {
				'scientist' 		: 'Thickness Change',
				'public' 			: 'Thickness Change'
			},
			'unitSystems'		: {
				'scientist' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
				},
				'public' 		: {
					'international'		: 'm / yr',
					'imperial'			: 'ft / yr'
					
				}
			}
		}
	};
}(window.vesl = window.vesl || {}, jQuery));

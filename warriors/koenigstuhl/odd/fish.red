;redcode
;name Fish
;author Lukasz Adamowski
;strategy Swims in Water :]
;assert CORESIZE==8000 
; MAXLENGTH==8 && MINDISTANCE==8

scale	dat	$5,	$4000
	dat	$4,	$15
	dat	$1,	$16
	dat	$2,	$15
	dat	$3,	$15
	dat	$4,	$15
start	mov	*scale,	>scale
	jmp	$-1,	>scale

	end	start

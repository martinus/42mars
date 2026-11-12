;redcode
;name Agony 4.1 kzkb
;author Stefan Strack
;strategy Small-interval CMP scanner that bombs with a SPL 0 carpet.
;strategy Tweaked and upcycled by Steve G
;assert CORESIZE==8000

CDIST	equ	12
IVAL	equ	3634
FIRST	equ	scan+OFFSET+IVAL
OFFSET	equ	(3634*1585)
DJNOFF	equ	6045

load	mov	#CDIST+(bptr-comp)+1	,count
scan	sub	incr	,comp
comp	cmp	FIRST-CDIST	,FIRST
	slt	#incr-comp+CDIST+(bptr-comp)+1	,comp
	djn	scan	,<FIRST+DJNOFF
	mov	comp	,bptr
bptr	dat	#0
split	mov	bomb	,<bptr
count	djn	split	,#CDIST+(bptr-comp)+1
	jmz	load	,load-1
bomb	spl	0	,<1-IVAL
	mov	incr	,<count
incr	dat	<0-IVAL	,<0-IVAL

end comp


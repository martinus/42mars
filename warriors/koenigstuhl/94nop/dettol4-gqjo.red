;redcode-94nop
;name Dettol E gqjo
;author Steve Gunnell
;strategy No boot Oneshot.
;assert CORESIZE==8000


STEP	equ	24
COUNT	equ	5603
SPACE	equ	10
GAP1	equ	1
GAP2	equ	17
REPEAT	equ	2
DECOY	equ	7582
BEGIN	equ	(sGO-STEP*COUNT)

gate	dat	BEGIN	,  BEGIN-SPACE
FOR  GAP1
	dat.f	$0	,  $0
ROF
	dat	1	,top-gate+REPEAT
clr	spl	#STEP	,STEP
	mov	*-2	,>gate
	mov	*-3	,>gate
top	djn.f	-2	,}clr
FOR  GAP2
	dat.f	$0	,  $0
ROF
	add.f	clr	,gate
sGO	sne	@gate	,*gate
	djn.f	-2	,<DECOY
	spl	clr	,<gate
	div.x	-1	,-1

     end  sGO

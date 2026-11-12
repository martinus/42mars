;redcode-94nop
;name Dettol C sqav
;author Steve Gunnell
;strategy Parametric oneshot
;assert CORESIZE==8000


STEP	equ	5339
COUNT	equ	7899
SPACE	equ	10
GAP1	equ	2
GAP2	equ	65
REPEAT	equ	2
DECOY	equ	1905
BEGIN	equ	(sGO-STEP*COUNT)

gate	dat	BEGIN	,  BEGIN-SPACE
FOR  GAP1
	dat.f	$0	,  $0
ROF
	dat	#-10	,  bot+3-gate
clr	spl	#-10	,  bot+3-gate
bom	mov	@bot	,  >gate
FOR  REPEAT
	mov	@bot	,  >gate
ROF
bot	djn.f	bom	,  {clr
FOR  GAP2
	dat.f	$0	,  $0
ROF
;type dual SNE no erase no ssprotect
	dat	STEP	,  STEP
	add.f	-1	,  gate
sGO	sne	@gate	,  *gate
	add.f	-3	,  gate
	sne	@gate	,  *gate
	djn.f	-4	,  <DECOY
	jmp	clr	,  <gate

     end  sGO

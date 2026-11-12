;redcode-94
;name Lucky Strike
;author Will 'Varfar'
;strategy A simple 4 liner, which uses Mizcu's
;strategy fabulous boot idea,so that if it is going
;strategy to be hit midsection by an imp arm, it
;strategy boots so it is no longer affected; result?
;strategy 100% win assured (as the imp has a slower
;strategy boot)
;assert 1

step equ 2667
bdist equ (step/2)

	;detect if going to get hit midsection
ring sne -step+safe,step+safe
jmp imp ; no risk, so no boot
boot mov @launch,{launch
djn boot, launch
launch jmp bdist, fall
	;wait for enemy
imp jmp imp
	;enemy imp can't follow
jmz.a fall, }safe
	;throw one bomb once
attack mov.i #1, <1 
	;and wait for imp to die
safe jmp #-1, imp
fall end

;	***** SCORE: 100% WINS *****

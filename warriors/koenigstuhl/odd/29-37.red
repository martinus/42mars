;redcode
;author Sascha Zapf
;name 29/37
;strat Sequence is the name of that thingy.
;assert 1
; CORESIZE==211

bomb	mul.f	#-8,-9
loop	sub.f	inkr,pos
start	mov.i	bomb,*pos
	mov.i	bomb,@pos
	jmz	loop,bed
inkr 	dat	#2,#2
bed	dat	#0,#0
pos     dat	#start-20,#start-21

	end start

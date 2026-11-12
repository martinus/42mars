;redcode-94m verbose
;name MulDemon
;author J.A.Denny
;strategy   silk,imp, all defensive...max survival?
;assert 1

range   equ     768
spawn   equ     3543
spawn2  equ     6968

kill    dat     <2667,  <2*2667
breed   spl     1,      <3000
	  spl	    1,	<4500
	  spl	    1,	<2200
boot    mov     {loc,   <loc
	spl     @loc,   <2000
demon   spl     @demon, #spawn
	mov.i   }demon, >demon
demon2  spl     @demon2,#spawn2
	mov.i   }demon2, >demon2
safety  spl     #0,     <-200
	spl     @imp,   <safety
	spl     imp+(2*2667),<safety
imp     mov.i   #20,    2667
loc     dat     loc,    4000
	end    breed


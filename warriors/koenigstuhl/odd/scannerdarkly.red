;redcode-m
;name a scanner darkly
;author el kauka
;strategy anti-stone oneshot
;assert 1

org	top

top	add.ab #2365-1,2
	jmz.f top,>ptr
ptr	jmz.f top, -3
	 jmp attack

for 25
 dat 0,0
rof

attack	mov.b ptr,cl
	add.ab #-95+ptr-cl,cl
	jmp dclear

for 24
 dat 0,0
rof
	
cl	dat 0,0
	dat 0,0
bmb	dat <2667,12

dclear	spl #0,#0
	mov.i bmb,>cl
	mov.i bmb,>cl
	djn.f -1,>cl

end


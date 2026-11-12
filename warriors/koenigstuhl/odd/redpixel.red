;redcode-94
;name RedPixel Unprepared v2.0
;reduced data buffers to fit into 25 lines.
;author John Kipling Lewis

;assert 1

res equ 6381


org top

tail    dat.f   -100,-100       ;target for gunning


dat 0,0


top     sub.ab  #res,#-100      ;subtract from traget
eyes    jmz.f   top,@top        ;scan for target
        slt     #15,top         ;if it's me, skip it
        djn     top,#100        ;if it's me decrement counter
vein    mov.b   top,target      ;mov target range into sight
        sub.ab  top,top         ;add range as next to be checked
	mov.f inc-1,inc		;reset targeter
	mov.ab   #13,jm
	spl	head		;launch nuke
	jmp 	eyes

step equ 24500

	dat #0,step
inc	spl #0,step	
head	slt.ab target, target
	jmp attack
target	sub #step, #20000
	mov }inc, >inc
jm	djn -1, #bot-inc+1
	mov.ab #bot-inc+1,jm+step
	jmp head+step
attack	mov.ba target, target
	mov inc,>target
	mov inc,{target
bot	djn attack+1, #100


;redcode 
;name x-gate 1
;author el kauka
;assert 1
org s
sts equ ((CORESIZE / 3)+1)
gst equ (CORESIZE / 5)

;create 5 gates
s mov x, gst
spl gst-1
add #gst,-2
add.a #gst,-2
djn -4, #5

;3pts imp
mov.i #sts,*0
mov -1, sts*2-2
spl sts*2-3
spl sts-3
jmp -3

;the x gate code ;-)
x djn.x #0, <-3

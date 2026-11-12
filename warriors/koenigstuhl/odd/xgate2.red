;redcode 
;name x-gate 2
;author el kauka
;assert 1
org s
sts equ ((CORESIZE / 3)+1)
gst equ 1000

;create 7 gates
s mov x, gst
spl gst-1
add #gst,-2
add.a #gst,-2
djn -4, #7


mov.i #1,*0


;the x gate code ;-)
x djn.x #0, <-3

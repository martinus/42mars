; I found I had to change it to jmp #0, <-98, because
; 100 happens to be the MINDISTANCE. So in very very
; rare circumstances the wimp would hit my imp before it
; was rolling.

; My warrior:

;redcode-94
;name anti-wimp-imp
;author Will 'Varfar'
;strategy decrementing the b field turns it into
;strategy a bomb that exactly hits the wimp
;assert 1

wimpdist equ 100 ;98

mov.i #wimpdist,*2
mov.i #wimpdist,*2
end

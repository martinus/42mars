;redcode-94x
;name Metcalf's OoS verbatim
;author Joonas Pihlaja
; but really by: John Metcalf
;strategy unusual scanner variation
;strategy .4c scan with .25c variable length spl carpet -> d-clear
;assert 1
; CORESIZE==800

; Joonas' note:  you probably optimised against this very warrior, but my
; .5c blur just wasn't cutting it.

step  equ 13
first equ 44
dist  equ 204
time  equ 42

	PIN	31
	stp	#12, #32
ptr:    sne   first,    first+dist
        add   db,       ptr
p:      mov   bomb,     }ptr
        mov   bomb,     >ptr
        djn   @p,       #time

bomb:   spl   #1,       1
        mov   db,       >ptr
        djn.f -1,       >ptr
db:     dat   step-1,   step-1
        end


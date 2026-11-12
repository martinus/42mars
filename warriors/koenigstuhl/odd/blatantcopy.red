;redcode-lp
;name Blatant Copy 
;author Robert Macrae
;strategy Copy of Joonas' 0.5c carpet bomber.
;assert 1
; KOFACOTO 2

; Holidays have struck. I have 20 minutes to get in an entry, or
; we miss our plane. Between my pride and divorce, no contest.

; This is a very nice little bomber and I have no time to code up
; my vampire which, in any case, would probably not beat it.

load0 z for 0
rof

hop     equ 4 ; hop
step    equ 2936 ; step
fence   equ (load0-16) ; fence
impdst  equ (load0-595) ; imp boot dist.

bjmp    jmp 4, hop

top     mov imp, @0        ; imp bomb them
        mov bjmp, @-1
        add #step, @-1
        jmz -3, fence      ; fall through on broken fence
        jmp 0, <top-4      ; gate them

imp     mov 0, 1

z for MAXLENGTH-CURLINE-9
        mov 0, 1
rof

go      mov imp, impdst    ; boot backup imp
        spl a2, <4567      ; 7 proc. for the stone
        spl 1, <2345
a1      spl 1, <3456
        jmp <0, top+4
a2      spl 1, <1234
        spl 1, top+4
        djn <-1, #4
        jmp impdst, <5678 ; one for the imp

        end go

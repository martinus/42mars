;redcode
;name Blimp
;author Ayan Chakrabarti
;url mailto:ayanthegreat@crosswinds.net
;strategy A very very (very) simple warrior. Bombs -> launches 8 imps.
;strategy on top of each other. 
;assert 1
; KOFACOTO 2

a equ 4414
b equ 2289
c equ 2287
      dat   #-2,#c
s     mov  <a,   b
      add   -2,  -1
      djn   -2, #3000
      spl 0
imp   mov 0,1
              end s


;redcode-94m
;name Spike
;author John Metcalf
;strategy vampire, pit = suicidal dat clear
;strategy Redcoders Frenzy: The Multi-Maniac Round
;assert CORESIZE==8000

st   equ   12
ptr  equ   vlo-10
gate equ   vlo-9

go:  mov   {-46,   {-90

vlo: mov   fang,   @fang
     add   inc,    fang
     jmp   vlo,    <gate

fang:jmp   pit-st, st
inc: dat   <-st,   <st

pit: mov   inc,    <ptr
     jmp   pit,    <gate
     end   go

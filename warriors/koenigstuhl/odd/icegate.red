;redcode-94m
;name Icegate
;author John Metcalf
;strategy bomb with imps -> gate. simple and effective
;strategy Redcoders Frenzy: The Multi-Maniac Round
;assert CORESIZE==8000

gate equ imp-5
st   equ 10

imp: mov.i #1,     1

go:  mov   {-45,   {-55
     mov   {-66,   {-76
     mov   {-87,   {-97

blo: mov   imp,    st*2
     add   #st,    blo
     djn   blo,    #792
     jmp   #0,     <gate
     end   go

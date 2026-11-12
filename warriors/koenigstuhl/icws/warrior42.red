;redcode
;name Warrior 42
;Tournament: ICWST'90
;Standard: CWS'88
;author Stefan Roettger 
;Sandstrasse 3 / W-8525 Uttenreuth / Germany
;assert 1
;
; A warrior with a simple strategy but nevertheless hard to beat
;
c     mov b, 4026
      mov a, <c
      mov p, <c
      mov l, <c
      spl @c
l     add #124, p
p     jmz l, p
a     mov 2, @p
b     jmp l

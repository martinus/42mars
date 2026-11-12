;redcode-nano
;name From the Ritz to the Rubble
;author Roy van Rijn
;assert 1

pAttack1        equ     cGo+58
pAttack2        equ     cGo+42
pAttack3        equ     cGo+46

cGo     spl     #-4             , <pAttack1
       mov.i   @pAttack2       , {cGo
       mov.i   >pAttack3       , {cGo+1
       mov.i   {cGo+1          , <pAttack1
cImp    mov.i   #1              , 1

end

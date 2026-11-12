;redcode-RF19
;name Plaid Clear
;author Chip Wendell
;strategy Gate + passive vamp + suicidal clear
;strategy Capture incoming imps, use them to power the clear
;assert 1

       org    start

gate   nop    42,      0
       nop    42,      0
       nop    42,      0
       nop    42,      0
ptr    nop    bottom+1, 0
prison mov    bomb,    }ptr
       djn.b  prison,  ptr      ;After clearing the core twice,
       djn.a  prison,  prison   ; the clear becomes suicidal
       dat    1,       1
       dat    1,       1
       dat    #bottom-ptr, 1
bomb   dat    #bottom-ptr, 1

start  spl    prison
keeper djn    #0,      gate
       nop    <gate+2, <gate+3
       jmp    keeper,  <gate+1
       dat    1,       1       ;Imp-gate protection
       dat    1,       1
bottom dat    1,       1

       end

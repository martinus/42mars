;redcode
;name Mini CLP
;author Michal Janeczek
;assert 1

dist  equ   5534
fence equ   32

head  dat   0           , dist
      mov.x *check      , @check
      mov   head        , >tail+1+fence+19
check sne.x head-fence  , tail+1+fence
      jmp   -2          , <head-fence-1
start mov   }head       , @head
      jmn   -1          , >head
tail  jmp   dist+head+1 , <dist+head-fence

      end   start

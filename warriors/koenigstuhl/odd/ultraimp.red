;redcode-irc32
;name     ULTRAimp
;author   Christian Schmidt
;strategy gate, gate, gate
;assert 1

iGo   mov    imp,  imp+128
      spl    @iGo
imp   mov.i   #-1,  1
        end
